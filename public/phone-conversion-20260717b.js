function gtag_report_conversion(url) {
  var navigationStarted = false;
  var callback = function () {
    if (navigationStarted) return;
    navigationStarted = true;
    if (typeof url !== "undefined") {
      window.location = url;
    }
  };

  if (typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: "AW-18197209529/D7xnCIHd_tEcELnDjeVD",
      value: 1.0,
      currency: "USD",
      event_callback: callback,
      event_timeout: 1500
    });
    window.setTimeout(callback, 1600);
  } else {
    callback();
  }

  return false;
}
