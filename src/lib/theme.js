export const getTheme = () => localStorage.getItem("theme") || "light";
export const setTheme = (theme) => {
  localStorage.setItem("theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
};
export const initTheme = () => {
  const theme = getTheme();
  document.documentElement.setAttribute("data-theme", theme);
  return theme;
};
