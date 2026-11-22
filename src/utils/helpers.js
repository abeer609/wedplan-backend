export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toObjectIdOrNull(id, mongoose) {
  return mongoose.isValidObjectId(id) ? id : null;
}
