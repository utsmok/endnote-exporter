import './styles.css';
import { mountApp } from './app/controller';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Application root element #app was not found.');
}

void mountApp(root);
