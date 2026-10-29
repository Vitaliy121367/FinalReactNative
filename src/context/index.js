import {createContext} from 'react';

const AppContext = createContext({
    theme: 'light',
    setTheme: () => {}
});

export default AppContext;