if(!localforage.supports(localforage.INDEXEDDB)) {
  alert('Your browser does not support IndexedDB. Please upgrade to a browser that supports it.')
  window.history.back();
}
const accountStorage = localforage.createInstance({ name: 'QuarkChat', storeName: 'account' });
const messageStorage = localforage.createInstance({ name: 'QuarkChat' , storeName: 'messages' });
