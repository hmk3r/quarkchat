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
  const responseBody = response.json();

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
  const responseBody = response.json();

  if (response.status >= 400) {
   const error = new Error(responseBody.message);
   error.name = responseBody.name
   throw error;
  }

  return responseBody;
}
