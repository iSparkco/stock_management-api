module.exports = function apiKeyAuth(req, res, next) {
    const key = req.header("X-API-KEY");
  
    if (!key) {
      return res.status(401).json({ error: "API key required" });
    }
  
    if (
      key !== process.env.FLUTTER_API_KEY &&
      key !== process.env.WPF_API_KEY
    ) {
      return res.status(403).json({ error: "Invalid API key" });
    }
  
    req.appName =
      key === process.env.FLUTTER_API_KEY ? "FLUTTER" : "WPF";
  
    next();
  };
  