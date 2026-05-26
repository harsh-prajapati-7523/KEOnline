const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:9001"
    : "http://192.168.31.148:9001";

export default BASE_URL;