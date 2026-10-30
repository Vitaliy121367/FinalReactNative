import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import AppContext from '../context';
import Header from '../components/Header';
import NetworkStatus from '../components/OfflineBanner';
import OffenseCard, { offenseKey } from '../components/OffenseCard';
import OffenseDetailsScreen from './OffenseDetailsScreen';
import { loadLocations, loadOffensesByLocation } from '../tools/api/offensesData';

// Центр за замовчуванням (Харків), поки немає жодної точки
const DEFAULT_CENTER = [49.9935, 36.2304];
const DEFAULT_ZOOM = 11;

// HTML зі сторінкою Leaflet. Бібліотека береться з CDN, тому для самої мапи
// (і плиток OpenStreetMap) потрібен інтернет
const buildHtml = ({ isLight, accent }) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${isLight ? '#e8e8e8' : '#121212'}; }
  ${isLight ? '' : '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }'}
  .pin {
    background: ${accent};
    color: #fff;
    border: 2px solid #fff;
    border-radius: 50%;
    text-align: center;
    font: bold 14px sans-serif;
    box-shadow: 0 1px 5px rgba(0,0,0,0.45);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  if (typeof L === 'undefined') {
    // Не вдалося завантажити Leaflet (немає інтернету)
    send({ type: 'error' });
  } else {
    var map = L.map('map').setView([${DEFAULT_CENTER[0]}, ${DEFAULT_CENTER[1]}], ${DEFAULT_ZOOM});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var layer = L.layerGroup().addTo(map);

    // Викликається з React Native: window.setMarkers([...], fit)
    window.setMarkers = function (points, fit) {
      layer.clearLayers();
      var bounds = [];

      points.forEach(function (p) {
        var size = p.count > 9 ? 40 : 34;
        var icon = L.divIcon({
          className: '',
          html: '<div class="pin" style="width:' + size + 'px;height:' + size + 'px;line-height:' + (size - 4) + 'px">' + p.count + '</div>',
          iconSize: [size, size]
        });

        L.marker([p.latitude, p.longitude], { icon: icon })
          .addTo(layer)
          .on('click', function () {
            send({ type: 'marker', latitude: p.latitude, longitude: p.longitude });
          });

        bounds.push([p.latitude, p.longitude]);
      });

      if (fit && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    };

    // Позиція користувача: синя точка + коло точності
    var userDot = null;
    var userAcc = null;

    window.setUserLocation = function (lat, lng, acc, center) {
      var ll = [lat, lng];
      if (!userDot) {
        userAcc = L.circle(ll, { radius: acc || 0, color: '#4285F4', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        userDot = L.circleMarker(ll, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#4285F4', fillOpacity: 1, interactive: false }).addTo(map);
      } else {
        userAcc.setLatLng(ll);
        userAcc.setRadius(acc || 0);
        userDot.setLatLng(ll);
      }
      if (center) {
        map.setView(ll, 15);
      }
    };

    // Кнопка «моя геолокація»
    window.centerOn = function (lat, lng) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    };

    send({ type: 'ready' });
  }
</script>
</body>
</html>`;

export default function MapScreen({ navigation }) {
    const { theme } = useContext(AppContext);
    const isLight = theme === 'light';

    const colors = {
        background: isLight ? '#ffffff' : '#121212',
        card: isLight ? '#ffffff' : '#1e1e1e',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#888888' : '#999999',
        accent: isLight ? '#2196F3' : '#904ee3',
    };

    const webRef = useRef(null);
    const fittedRef = useRef(false);

    const [locations, setLocations] = useState([]);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // readyCount збільшується щоразу, коли сторінка Leaflet завантажилась
    // (наприклад, після зміни теми), і маркери треба передати знову
    const [readyCount, setReadyCount] = useState(0);
    const [mapFailed, setMapFailed] = useState(false);

    // Геолокація користувача
    const [userPos, setUserPos] = useState(null); // { latitude, longitude, accuracy }
    const [permissionDenied, setPermissionDenied] = useState(false);
    const centeredRef = useRef(false); // true, коли мапу вже відцентровано на користувачі

    const [selected, setSelected] = useState(null); // { latitude, longitude }
    const [selectedOffenses, setSelectedOffenses] = useState([]);
    const [selectedLoading, setSelectedLoading] = useState(false);
    const [detailsOffense, setDetailsOffense] = useState(null); // запис, відкритий у модальному вікні

    const html = useMemo(
        () => buildHtml({ isLight, accent: colors.accent }),
        [isLight, colors.accent]
    );

    // Завантажуємо точки при кожному поверненні на екран
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            setLoading(true);

            loadLocations()
                .then(({ locations: points, offline: isOffline }) => {
                    if (cancelled) return;
                    setLocations(points);
                    setOffline(isOffline);
                    setError(null);
                })
                .catch((e) => {
                    if (cancelled) return;
                    setLocations([]);
                    setError(e.message || 'Не вдалося завантажити дані');
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });

            return () => {
                cancelled = true;
            };
        }, [])
    );

    // Передаємо маркери в Leaflet, коли є і мапа, і дані
    useEffect(() => {
        if (readyCount === 0 || !webRef.current) return;

        // Якщо мапа вже відцентрована на користувачі, не збиваємо її підгонкою під маркери
        const fit = !fittedRef.current && !centeredRef.current && locations.length > 0;
        if (fit) fittedRef.current = true;

        webRef.current.injectJavaScript(
            `window.setMarkers(${JSON.stringify(locations)}, ${fit}); true;`
        );
    }, [readyCount, locations]);

    // Запит дозволу і стеження за позицією
    useEffect(() => {
        let active = true;
        let subscription = null;

        const toPos = ({ coords }) => ({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
        });

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!active) return;

                if (status !== 'granted') {
                    setPermissionDenied(true);
                    return;
                }
                setPermissionDenied(false);

                // Остання відома позиція з'являється миттєво, точна — за кілька секунд
                const last = await Location.getLastKnownPositionAsync().catch(() => null);
                if (active && last) setUserPos(toPos(last));

                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 10, // оновлювати, коли зсув більше 10 м
                        timeInterval: 5000,
                    },
                    (position) => setUserPos(toPos(position))
                );

                // Екран закрили, поки чекали підписку
                if (!active) subscription.remove();
            } catch (e) {
                console.error('Error getting location:', e);
            }
        })();

        return () => {
            active = false;
            if (subscription) subscription.remove();
        };
    }, []);

    // Передаємо позицію в Leaflet; при першій позиції центруємо мапу на користувачі
    useEffect(() => {
        if (readyCount === 0 || !webRef.current || !userPos) return;

        const center = !centeredRef.current;
        centeredRef.current = true;

        webRef.current.injectJavaScript(
            `window.setUserLocation(${userPos.latitude}, ${userPos.longitude}, ${userPos.accuracy ?? 0}, ${center}); true;`
        );
    }, [readyCount, userPos]);

    const handleLocatePress = () => {
        if (permissionDenied) {
            Linking.openSettings();
            return;
        }
        if (userPos && webRef.current) {
            webRef.current.injectJavaScript(
                `window.centerOn(${userPos.latitude}, ${userPos.longitude}); true;`
            );
        }
    };

    const openLocation = async (latitude, longitude) => {
        setSelected({ latitude, longitude });
        setSelectedOffenses([]);
        setSelectedLoading(true);

        try {
            const result = await loadOffensesByLocation(latitude, longitude);
            setSelectedOffenses(result.offenses);
        } catch (e) {
            setSelectedOffenses([]);
        } finally {
            setSelectedLoading(false);
        }
    };

    const handleMessage = (event) => {
        let message;
        try {
            message = JSON.parse(event.nativeEvent.data);
        } catch (e) {
            return;
        }

        if (message.type === 'ready') {
            fittedRef.current = false;
            centeredRef.current = false;
            setMapFailed(false);
            setReadyCount((n) => n + 1);
        } else if (message.type === 'error') {
            setMapFailed(true);
        } else if (message.type === 'marker') {
            openLocation(message.latitude, message.longitude);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                marginTop: 15,
                marginLeft: 15
            }}>
                <Header />
                <NetworkStatus />
            </View>

            <View style={styles.mapWrapper}>
                <WebView
                    key={isLight ? 'light' : 'dark'}
                    ref={webRef}
                    originWhitelist={['*']}
                    // baseUrl потрібен, щоб плитки OpenStreetMap отримували Referer
                    source={{ html, baseUrl: 'https://localhost' }}
                    onMessage={handleMessage}
                    javaScriptEnabled
                    domStorageEnabled
                    style={{ backgroundColor: colors.background }}
                />

                {loading && (
                    <View style={styles.loader} pointerEvents="none">
                        <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                )}

                {mapFailed && (
                    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
                        <Ionicons name="map-outline" size={48} color={colors.muted} />
                        <Text style={[styles.overlayText, { color: colors.muted }]}>
                            Мапа недоступна без інтернету
                        </Text>
                    </View>
                )}

                {(error || (offline && !mapFailed) || permissionDenied) && (
                    <View style={[styles.banner, { backgroundColor: colors.card }]} pointerEvents="none">
                        <Text style={{ color: error ? '#d32f2f' : colors.muted, fontSize: 12, textAlign: 'center' }}>
                            {error
                                || (permissionDenied && !offline
                                    ? 'Немає доступу до геолокації. Натисніть кнопку справа, щоб відкрити налаштування'
                                    : 'Офлайн: показано лише збережені на пристрої записи')}
                        </Text>
                    </View>
                )}

                {!mapFailed && (
                    <Pressable
                        onPress={handleLocatePress}
                        style={[
                            styles.locateButton,
                            { backgroundColor: colors.card, bottom: selected ? '52%' : 16 },
                        ]}
                    >
                        <Ionicons
                            name={permissionDenied ? 'location-outline' : 'locate'}
                            size={24}
                            color={permissionDenied ? colors.muted : colors.accent}
                        />
                    </Pressable>
                )}

                {selected && (
                    <View style={[styles.sheet, { backgroundColor: colors.card }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text }]}>
                                {selectedLoading
                                    ? 'Завантаження...'
                                    : `Правопорушень у точці: ${selectedOffenses.length}`}
                            </Text>
                            <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </Pressable>
                        </View>

                        {selectedLoading ? (
                            <ActivityIndicator style={{ margin: 16 }} color={colors.accent} />
                        ) : (
                            <FlatList
                                data={selectedOffenses}
                                keyExtractor={offenseKey}
                                renderItem={({ item }) => (
                                    <OffenseCard
                                        offense={item}
                                        onPress={() => setDetailsOffense(item)}
                                    />
                                )}
                                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                                contentContainerStyle={{ padding: 12 }}
                                ListEmptyComponent={
                                    <Text style={[styles.empty, { color: colors.muted }]}>
                                        Записів у цій точці немає
                                    </Text>
                                }
                            />
                        )}
                    </View>
                )}
            </View>

            {/* Деталі відкриваються тут же, тому окремий екран у навігаторі не потрібен */}
            <Modal
                visible={detailsOffense !== null}
                animationType="slide"
                onRequestClose={() => setDetailsOffense(null)}
            >
                <SafeAreaView
                    style={{
                        flex: 1,
                        backgroundColor: colors.background,
                        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
                    }}
                >
                    <View style={styles.modalBar}>
                        <Pressable
                            onPress={() => setDetailsOffense(null)}
                            hitSlop={12}
                            style={styles.modalBack}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.text} />
                            <Text style={{ color: colors.text, fontSize: 16 }}>Назад</Text>
                        </Pressable>
                    </View>

                    {detailsOffense && (
                        <OffenseDetailsScreen route={{ params: { offense: detailsOffense } }} />
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapWrapper: {
        flex: 1,
    },
    loader: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlayText: {
        marginTop: 12,
        fontSize: 15,
    },
    banner: {
        position: 'absolute',
        top: 8,
        left: 12,
        right: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        opacity: 0.95,
    },
    modalBar: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    modalBack: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    locateButton: {
        position: 'absolute',
        right: 12,
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '50%',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 4,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    empty: {
        textAlign: 'center',
        marginTop: 16,
        fontSize: 14,
    },
});