import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { defaultInput } from './engine/input';
import { defaultDeck } from './ui/deck';
import { fetchStars } from './ui/github';
import { mountApp } from './ui/render';
import { loadDeck, loadInput, saveDeck, saveInput } from './ui/storage';

registerSW({ immediate: true });

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const app = mountApp(root, loadInput() ?? defaultInput(), saveInput, {
  initial: loadDeck() ?? defaultDeck(),
  onChange: saveDeck,
});
void fetchStars().then((n) => {
  if (n !== null) app.setStars(n);
});
