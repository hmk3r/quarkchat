# Quark chat

## Installation

- MongoDB version 4.2.1(or later) must be installed, running at its default port (27017) without authentication
- Node version 12.16.2(or later) must be installed. If you have [nvm](https://github.com/nvm-sh/nvm) installed, just run `nvm install && nvm use` the project's directory (this nvm feature does not work in a Windows environment)

1. Clone this repository
2. Open a terminal and navigate to the repository
3. Run `npm install` and wait for the dependencies to be installed
4. Run `npm start` to start the application. Configuration options are available (see the [Configuration](#configuration) section).
5. Open a web-browser. By default, the app is available at <http://localhost:8080>

    **NOTE:** In order to be used on devices other than localhost, the app needs to be accessed over an https connection due to [WebCrypto API limitations](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts/features_restricted_to_secure_contexts). A quick way to overcome this is to use a tunnelling reverse proxy such as [ngrok](https://ngrok.com/)

## Configuration

Some application variables can be controlled by the user. These are to be passed as environmental variables, i.e.:

- Defined for this specific instance of the app

  ```bash
  VARIABLE1=value1 VARIABLE2=value2 npm start
  ```

    **or**

- Defined globally in the shell configuration file (e.g. .bashrc, .zshrc, .bash_profile, etc.)
  
  ```bash
  export VARIABLE=value
  ```

The following variables are user configurable:

| Variable        | Type           | Description  | Default value|
| ------------- |:-------------:|:-----|:-----:|
| CONNECTION_STRING | [MongoDB connection string](https://docs.mongodb.com/manual/reference/connection-string/#connections-standard-connection-string-format) | Connection string for the mongodb database |mongodb://localhost/QuarkChatDB |
| NODE_ENV      | string | One of `development` or `production`. When this variable is set to `production`, the CONNECTION_STRING variable must be also set and error messages are not printed to the console|development |
| PORT | integer | The port the application runs at| 8080 |
| CHALLENGE_TIMEOUT | integer | The timeout for the challenges served to users in ***ms*** |60000|
|SPK_RENEWAL_INTERVAL_UNIT | string|The [time unit](https://momentjs.com/docs/#/manipulating/add/) for users' Signed pre-key change interval|M|
|SPK_RENEWAL_INTERVAL_VALUE |integer|The value of SPK_RENEWAL_INTERVAL_UNIT |1|
|LOW_OTPK_WARNING_THRESHOLD |integer|The amount of one-time pre-keys for a user which, upon reached, makes the server request from the client(user) to submit more one-time pre-keys|5|

## Development

- Run with `npm run dev` instead of `npm start` for the application to automatically restart upon changing a file
- Run unit tests with `npm test`
- Check syntax and code style with `npm run lint`
