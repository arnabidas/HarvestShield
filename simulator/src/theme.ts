import tokens from '../../assets/harvestshield_theme.json';

export const embedded = new URLSearchParams(location.search).has('streamlitUrl');
export function applyTheme() {
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
  document.documentElement.classList.toggle('embedded-machine', embedded);
}
