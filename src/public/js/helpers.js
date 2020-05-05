// Adapted from https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Supplying_request_options
async function postJson(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *client
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  const responseBody = await response.json();

  if (response.status >= 400) {
   const error = new Error(responseBody.message);
   error.name = responseBody.name
   throw error;
  }

  return responseBody;
}

// Adapted from https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#Supplying_request_options
async function getJson(url = '') {
  const response = await fetch(url, {
    credentials: 'same-origin',
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *client
  });
  const responseBody = await response.json();

  if (response.status >= 400) {
   const error = new Error(responseBody.message);
   error.name = responseBody.name
   throw error;
  }

  return responseBody;
}


function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Date.prototype.toLocaleDateTimeString = function() {
  return moment(this).format('HH:mm   |   MMM DD YYYY')
}

const typedJSON = (() => {
  const TYPE_FIELD = '__$$type'
  const VALUE_FIELD = '__$$value'

  function replacer(key, value) {
    let tmpBuffer;
    if (this[key] instanceof Date) {
      return {
        [TYPE_FIELD]: this[key].constructor.name,
        [VALUE_FIELD]: this[key].toJSON()
      }
    } else if (value instanceof ArrayBuffer) {
      tmpBuffer = value;
    } else if (ArrayBuffer.isView(value)) {
      tmpBuffer = value.buffer;
    } else {
      return value;
    }

    return {
      [TYPE_FIELD]: value.constructor.name,
      [VALUE_FIELD]: cryptoHelper.bufToBase64(tmpBuffer)
    }
  }

  function reviver(key, value) {
    if(!value[TYPE_FIELD] || !value[VALUE_FIELD]) {
      return value;
    }

    if (value[TYPE_FIELD] === Date.name) {
      return new Date(value[VALUE_FIELD]);
    }

    const tmpBuffer = cryptoHelper.base64ToBuf(value[VALUE_FIELD])
    
    if (value[TYPE_FIELD] === ArrayBuffer.name) {
      return tmpBuffer;
    }

    return new window[value[TYPE_FIELD]](tmpBuffer);
  }

  function parse(string) {
    return JSON.parse(string, reviver)
  }

  function stringify(object) {
    return JSON.stringify(object, replacer)
  }

  return {
    parse,
    stringify
  }
})();
