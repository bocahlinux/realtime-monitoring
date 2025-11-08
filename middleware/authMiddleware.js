export function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

export function requireLevel(levels) {
  return (req, res, next) => {
    if (!req.session.user || !levels.includes(req.session.user.level)) {
      return res.status(403).send("Akses ditolak");
    }
    next();
  };
}
