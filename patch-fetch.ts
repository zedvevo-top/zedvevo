const originalFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    return await originalFetch.apply(this, args);
  } catch (err) {
    console.error("FETCH ERROR:", err, "URL:", args[0]);
    throw err;
  }
};
