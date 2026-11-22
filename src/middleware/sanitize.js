const DANGEROUS_KEY = /^\$|\./;

function clean(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i]);
    return value;
  }
  if (value && typeof value === "object" && !(value instanceof Buffer)) {
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEY.test(key)) {
        delete value[key];
        continue;
      }
      value[key] = clean(value[key]);
    }
  }
  return value;
}

export const sanitize = (req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") clean(req.body);
    if (req.params && typeof req.params === "object") clean(req.params);
  } catch {
    // never block the request on sanitization
  }
  next();
};
