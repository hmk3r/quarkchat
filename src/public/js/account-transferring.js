const databaseTables = {
  accountStorage,
  messageStorage,
  pkStorage,
  otpkStorage,
  stateStorage,
  contactsPublicKeysStorage,
  contactsADStorage
}

const localStorageItemsNames = ['conversations', 'conversationsOrder', 'verifiedContacts', 'drafts']

async function exportAccountToJson(password, shouldClearDatabase) {
  const dbTables = {};
  const localStorageItems = {};

  for (const lsi of localStorageItemsNames) {
    localStorageItems[lsi] = JSON.stringify(app[lsi]);
  }

  for (const dbTableName in databaseTables) {
    if (!databaseTables.hasOwnProperty(dbTableName)) continue;

    const tmpData = {};
    await databaseTables[dbTableName].iterate((value, key) => { tmpData[key] = value})
    dbTables[dbTableName] = tmpData
  }

  const allDataJSONString = typedJSON.stringify({
    dbTables,
    localStorageItems
  })

  const pbkdfSalt = cryptoHelper.generatePbkdf2Salt();
  const aesKey = await cryptoHelper.deriveAESKey(password, pbkdfSalt);
  const encryptionResult = await cryptoHelper.encryptAES(aesKey, allDataJSONString);
  encryptionResult.pbkdfSalt = pbkdfSalt;

  if (shouldClearDatabase) {
    for (const dbTableName in databaseTables) {
      if (!databaseTables.hasOwnProperty(dbTableName)) continue;

      await databaseTables[dbTableName].clear()
    }

    localStorage.clear()
  }

  return typedJSON.stringify(encryptionResult);
}

async function importAccount(accountDataEncryptedString, password, shouldStoreToDatabase) {
  const {
    pbkdfSalt,
    encryptedData,
    iv
  } = typedJSON.parse(accountDataEncryptedString);

  const aesKey = await cryptoHelper.deriveAESKey(password, pbkdfSalt)
  const allDataJSONString = await cryptoHelper.decryptAES(aesKey, encryptedData, iv);
  const accountData = typedJSON.parse(allDataJSONString)
  const {
    dbTables,
    localStorageItems
  } = accountData;

  if (shouldStoreToDatabase) {
    for (const lsi of localStorageItemsNames) {
      localStorage.setItem(lsi, localStorageItems[lsi])
    }
  
    for (const dbTableName in dbTables) {
      if (!dbTables.hasOwnProperty(dbTableName)) continue;
  
      for (const key in dbTables[dbTableName]) {
        if (!dbTables[dbTableName].hasOwnProperty(key)) continue;
  
        await databaseTables[dbTableName].setItem(key, dbTables[dbTableName][key]);
      }
    }
  }

  return accountData;
}
