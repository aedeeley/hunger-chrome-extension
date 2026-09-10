document.querySelector("#back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.replace("https://www.google.com/");
});
