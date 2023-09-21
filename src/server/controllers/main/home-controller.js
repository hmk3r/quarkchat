module.exports = function(params) {
  return {
    home(req, res) {
      res.render('main');
    },
  };
};
