import React, { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';

import AppContext from '../context';
import { createOffense } from '../tools/api/offenses';
import { saveOffense } from '../tools/database/database';
import Header from '../components/Header';
import NetworkStatus from '../components/OfflineBanner';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';

const MAX_DESCRIPTION = 500;

// Показувати кнопку «Галерея» поруч із «Камера».
// За умовами завдання фото робиться лише камерою, тож перед захистом постав false
const ALLOW_GALLERY = true;

export default function AddOffenseScreen({ navigation }) {
    const { theme } = useContext(AppContext);
    const { token, user } = useAuth();
    const { syncNow, refreshPending } = useNetwork();

    // Висота заголовка Drawer: без неї відступ над клавіатурою рахується неточно
    const headerHeight = useHeaderHeight();

    const isLight = theme === 'light';
    const colors = {
        background: isLight ? '#ffffff' : '#121212',
        card: isLight ? '#f2f2f2' : '#1e1e1e',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#666666' : '#aaaaaa',
        border: isLight ? '#dddddd' : '#333333',
        accent: isLight ? '#2196F3' : '#904ee3',
    };

    const [description, setDescription] = useState('');
    const [photo, setPhoto] = useState(null); // { uri, base64 }
    const [photoLoading, setPhotoLoading] = useState(false);
    const [coords, setCoords] = useState(null); // { latitude, longitude }
    const [locating, setLocating] = useState(false);
    const [locationDenied, setLocationDenied] = useState(false);
    const [saving, setSaving] = useState(false);

    // Визначаємо місце одразу при відкритті екрана (GPS працює і без інтернету)
    const detectLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationDenied(true);
                return;
            }
            setLocationDenied(false);

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            setCoords({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
        } catch (e) {
            console.error('Error getting location:', e);
        } finally {
            setLocating(false);
        }
    };

    useEffect(() => {
        detectLocation();
    }, []);

    const handlePickerResult = (result) => {
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        setPhoto({ uri: asset.uri, base64: asset.base64 });
    };

    // Запускає камеру/галерею і показує індикатор, поки фото відкривається й обробляється
    const runPicker = async (launch) => {
        setPhotoLoading(true);
        try {
            const result = await launch();
            handlePickerResult(result);
        } catch (e) {
            console.error('Error picking photo:', e);
            Alert.alert('Не вдалося отримати фото', e.message || 'Спробуйте ще раз');
        } finally {
            setPhotoLoading(false);
        }
    };

    // quality 0.5 і base64: true, щоб запит не був надто важким
    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Немає доступу до камери', 'Дозвольте доступ у налаштуваннях', [
                { text: 'Скасувати', style: 'cancel' },
                { text: 'Налаштування', onPress: () => Linking.openSettings() },
            ]);
            return;
        }

        runPicker(() =>
            ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.5,
                base64: true,
            })
        );
    };

    const pickFromGallery = () =>
        runPicker(() =>
            ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.5,
                base64: true,
            })
        );

    const handleSubmit = async () => {
        if (saving || photoLoading) return;
        Keyboard.dismiss();

        const text = description.trim();
        if (!text) {
            Alert.alert('Опишіть правопорушення', 'Поле опису не може бути порожнім');
            return;
        }
        if (!token) {
            Alert.alert('Потрібен вхід', 'Увійдіть в акаунт, щоб додавати правопорушення');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                description: text,
                date: new Date().toISOString(),
                clientId: Crypto.randomUUID(),
                imageBase64: photo?.base64 ?? null,
                latitude: coords?.latitude ?? null,
                longitude: coords?.longitude ?? null,
            };

            let synced = false;

            try {
                await createOffense(payload, token);
                synced = true;
            } catch (error) {
                // Помилки сервера (400, 401...) показуємо як є.
                // Лише відсутність зв'язку (або таймаут) означає «збережемо локально»
                if (!error.isNetworkError) {
                    throw error;
                }

                await saveOffense({
                    ...payload,
                    userId: user?.id ?? null,
                });
            }

            // Запис збережено (на сервері або локально): очищаємо форму,
            // бо екран вкладки лишається змонтованим після goBack()
            setDescription('');
            setPhoto(null);
            setCoords(null);
            detectLocation();

            // Збережено на сервері: заодно відправляємо старі записи з черги.
            // Збережено локально: оновлюємо лічильник «Не синхронізовано»
            if (synced) {
                syncNow();
            } else {
                refreshPending();
            }

            Alert.alert(
                synced ? 'Збережено' : 'Збережено на пристрої',
                synced
                    ? 'Правопорушення відправлено на сервер'
                    : "Немає зв'язку з сервером. Запис відправиться, коли з'явиться інтернет",
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e) {
            Alert.alert('Не вдалося зберегти', e.message || 'Спробуйте ще раз');
        } finally {
            setSaving(false);
        }
    };

    const busy = saving || photoLoading;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            // 'padding' потрібен і на Android: у режимі edge-to-edge вікно
            // не стискається саме, тож клавіатура перекриває поля
            behavior="padding"
            keyboardVerticalOffset={headerHeight}
        >
            <ScrollView
                style={{ backgroundColor: colors.background }}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                    }}
                >
                    <Header />
                    <NetworkStatus />
                </View>

                {photoLoading ? (
                    <View style={[styles.image, styles.placeholder, { backgroundColor: colors.card }]}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={{ color: colors.muted, marginTop: 8 }}>Завантаження фото...</Text>
                    </View>
                ) : photo ? (
                    <View>
                        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
                        <Pressable style={styles.removePhoto} onPress={() => setPhoto(null)} hitSlop={8}>
                            <Ionicons name="close" size={20} color="#ffffff" />
                        </Pressable>
                    </View>
                ) : (
                    <View style={[styles.image, styles.placeholder, { backgroundColor: colors.card }]}>
                        <Ionicons name="image-outline" size={48} color={colors.muted} />
                        <Text style={{ color: colors.muted, marginTop: 8 }}>Фото не додано</Text>
                    </View>
                )}

                <View style={styles.photoButtons}>
                    <Pressable
                        style={[
                            styles.photoButton,
                            { borderColor: colors.accent },
                            busy && { opacity: 0.5 },
                        ]}
                        onPress={takePhoto}
                        disabled={busy}
                    >
                        <Ionicons name="camera-outline" size={20} color={colors.accent} />
                        <Text style={[styles.photoButtonText, { color: colors.accent }]}>Камера</Text>
                    </Pressable>

                    {ALLOW_GALLERY && (
                        <Pressable
                            style={[
                                styles.photoButton,
                                { borderColor: colors.accent },
                                busy && { opacity: 0.5 },
                            ]}
                            onPress={pickFromGallery}
                            disabled={busy}
                        >
                            <Ionicons name="images-outline" size={20} color={colors.accent} />
                            <Text style={[styles.photoButtonText, { color: colors.accent }]}>Галерея</Text>
                        </Pressable>
                    )}
                </View>

                {/* Опис */}
                <TextInput
                    style={[
                        styles.input,
                        { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    placeholder="Опишіть правопорушення"
                    placeholderTextColor={colors.muted}
                    value={description}
                    onChangeText={setDescription}
                    maxLength={MAX_DESCRIPTION}
                    multiline
                    textAlignVertical="top"
                />
                <Text style={[styles.counter, { color: colors.muted }]}>
                    {description.length}/{MAX_DESCRIPTION}
                </Text>

                {/* Місце */}
                <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={20} color={colors.muted} />

                    {locating ? (
                        <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />
                    ) : coords ? (
                        <Text style={[styles.locationText, { color: colors.muted }]}>
                            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                        </Text>
                    ) : (
                        <Text style={[styles.locationText, { color: colors.muted }]}>
                            {locationDenied
                                ? 'Немає доступу до геолокації. Запис буде без місця'
                                : 'Місце не визначено'}
                        </Text>
                    )}

                    <Pressable
                        onPress={locationDenied ? Linking.openSettings : detectLocation}
                        hitSlop={10}
                        style={{ marginLeft: 'auto' }}
                    >
                        <Text style={{ color: colors.accent }}>
                            {locationDenied ? 'Налаштування' : 'Оновити'}
                        </Text>
                    </Pressable>
                </View>

                {/* Відправка */}
                <Pressable
                    style={[styles.submit, { backgroundColor: colors.accent }, busy && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={busy}
                >
                    {saving ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.submitText}>Зберегти</Text>
                    )}
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 16,
    },
    image: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 12,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePhoto: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoButtons: {
        flexDirection: 'row',
        marginTop: 12,
        marginBottom: 16,
    },
    photoButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        marginHorizontal: 4,
    },
    photoButtonText: {
        marginLeft: 6,
        fontSize: 15,
    },
    input: {
        minHeight: 110,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    counter: {
        alignSelf: 'flex-end',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 12,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    locationText: {
        marginLeft: 8,
        fontSize: 14,
        flexShrink: 1,
    },
    submit: {
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});