const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:9001"
    : "http://192.168.31.148:9001";

export default BASE_URL;