import './styles.css';
import { defaultInput } from './engine/input';
import { mountApp } from './ui/render';
import { loadInput, saveInput } from './ui/storage';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
mountApp(root, loadInput() ?? defaultInput(), saveInput);
