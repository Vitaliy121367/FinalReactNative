import {useContext} from 'react';
import {Text, View} from 'react-native';
import {
    DrawerContentScrollView,
    DrawerItem,
    DrawerItemList,
} from '@react-navigation/drawer';
import {RadioButton} from 'react-native-paper';
import AppContext from '../../context';
import {useAuth} from '../../context/AuthContext';

export default function CustomDrawerContent(props) {
    const {theme, setTheme} = useContext(AppContext);
    const {user, logout} = useAuth();

    const textColor = theme === 'light' ? '#000000' : '#ffffff';

    const handleLogout = async () => {
        // Спочатку закриваємо меню, потім виходимо з акаунта
        props.navigation.closeDrawer();
        await logout();
    };

    return (
        <DrawerContentScrollView
            {...props}
            style={{backgroundColor: theme === 'light' ? '#ffffff' : '#121212'}}
        >
            <Text style={{
                margin: 10,
                fontSize: 16,
                fontWeight: 'bold',
                color: textColor
            }}>
                Choose theme
            </Text>

            <View style={{marginLeft: 20}}>
                <RadioButton.Group
                    onValueChange={(value) => setTheme(value)}
                    value={theme}
                >
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                        <RadioButton value="light" />
                        <Text style={{color: textColor}}>Light Theme</Text>
                    </View>

                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                        <RadioButton value="dark" />
                        <Text style={{color: textColor}}>Dark Theme</Text>
                    </View>
                </RadioButton.Group>
            </View>

            <DrawerItemList {...props} />

            {/* Кнопка виходу показується лише залогіненому користувачу */}
            {user && (
                <DrawerItem
                    label="Logout"
                    labelStyle={{color: '#ff0000'}}
                    onPress={handleLogout}
                />
            )}
        </DrawerContentScrollView>
    );
}