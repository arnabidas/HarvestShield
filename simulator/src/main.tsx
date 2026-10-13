import {createRoot} from 'react-dom/client';
import App from './app/App';
import './styles.css';
import {mountInStreamlit} from './streamlit';
mountInStreamlit(() => createRoot(document.getElementById('root')!).render(<App/>));
