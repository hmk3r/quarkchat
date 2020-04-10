const sinonModule = require('sinon');

describe('home-controller-tests', () => {
  it('home() should render home', () => {
    // setup mock data
    const req = {};
    const data = {};
    const homeController =
      require('../../src/server/controllers/main/home-controller')({data});

    // describe express' res object to be mocked
    const res = {
      status() {
        return this;
      },
      render() {
        return this;
      },
      redirect() {
        return this;
      },
      locals: {
        page: {
        },
      },
    };

    // set assertions
    const expectedRoute = 'main';
    const resMock = sinonModule.mock(res);
    resMock
        .expects('render')
        .returnsThis()
        .withArgs(expectedRoute)
        .once();

    homeController.home(req, res);
  });
});
