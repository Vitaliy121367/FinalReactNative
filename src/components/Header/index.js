import React, {useContext} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {format, getDay, getMonth} from 'date-fns';
import AppContext from "../../context";

export default function Header() {
    const today = new Date();
    const year = format(today, 'yyyy');
    const month = format(today, 'MMMM');
    const dayName = format(today, 'EEE');
    const day = format(today, 'dd');
    const { theme } = useContext(AppContext);
    const isDark = theme === 'dark';
    return (
        <View  style={styles.container}>
            <Text style={{fontSize: 16, color: theme === 'light' ? '#000' : '#fff'}}>
                {dayName} {day}, {month} {year}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20,
    },
});
