module.exports.requireRole = function (roles) {
  return function (req, res, next) {
    if (!req.session.user) return res.redirect("/auth/login");

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).send("Akses ditolak.");
    }

    next();
  };
};
