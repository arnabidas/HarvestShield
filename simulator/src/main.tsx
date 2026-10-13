import {createRoot} from 'react-dom/client';
import App from './app/App';
import './styles.css';
import './dashboard.css';
import {applyTheme} from './theme';
import {mountInStreamlit} from './streamlit';
applyTheme();
mountInStreamlit(() => createRoot(document.getElementById('root')!).render(<App/>));
