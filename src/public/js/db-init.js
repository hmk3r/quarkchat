if(!localforage.supports(localforage.INDEXEDDB)) {
  alert('Your browser does not support IndexedDB. Please upgrade to a browser that supports it.')
  window.history.back();
}
const accountStorage = localforage.createInstance({ name: 'QuarkChat', storeName: 'account' });
const messageStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'messages' });
const pkStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'prekeys' })
const otpkStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'onetimeprekeys' })
const stateStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'states' })
const contactsPublicKeysStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'contactspbks' })
const contactsADStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'contactsad' })
