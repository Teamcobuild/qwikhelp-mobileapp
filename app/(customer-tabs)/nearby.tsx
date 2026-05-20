import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import * as Location from 'expo-location';
import { minimalMapStyle } from '../../constants/mapStyle';

const { width, height } = Dimensions.get('window');

const MOCK_PROVIDERS = [
  { id: '1', name: 'Martins kelly', distance: '2km from you', rating: '5.0', image: 'https://i.pravatar.cc/150?img=11', latOffset: 0.005, lngOffset: 0.005 },
  { id: '2', name: 'Sarah Jones', distance: '3km from you', rating: '4.0', image: 'https://i.pravatar.cc/150?img=5', latOffset: 0.002, lngOffset: -0.006 },
  { id: '3', name: 'John Doe', distance: '1km from you', rating: '3.0', image: 'https://i.pravatar.cc/150?img=12', latOffset: -0.004, lngOffset: -0.008 },
  { id: '4', name: 'Alice Smith', distance: '4km from you', rating: '5.0', image: 'https://i.pravatar.cc/150?img=9', latOffset: -0.007, lngOffset: 0.004 },
  { id: '5', name: 'Bob Johnson', distance: '5km from you', rating: '2.0', image: 'https://i.pravatar.cc/150?img=13', latOffset: -0.009, lngOffset: -0.005 },
];

export default function NearbyScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  if (!location) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Locating you...</Text>
      </SafeAreaView>
    );
  }

  const initialRegion = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={initialRegion}
        customMapStyle={minimalMapStyle}
        onPress={() => setSelectedProviderId(null)}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Radar Rings (Innermost to outermost) */}
        <Circle
          center={initialRegion}
          radius={200}
          fillColor="rgba(255, 255, 255, 1)"
          strokeColor="rgba(239, 68, 68, 1)"
          strokeWidth={2}
        />
        <Circle
          center={initialRegion}
          radius={500}
          fillColor="rgba(255, 99, 71, 0.25)"
          strokeColor="transparent"
        />
        <Circle
          center={initialRegion}
          radius={1200}
          fillColor="rgba(255, 99, 71, 0.12)"
          strokeColor="transparent"
        />
        <Circle
          center={initialRegion}
          radius={2200}
          fillColor="rgba(255, 99, 71, 0.06)"
          strokeColor="transparent"
        />

        {/* User Pin */}
        <Marker coordinate={initialRegion} zIndex={100}>
          <View style={styles.userMarkerContainer}>
            <View style={styles.userMarkerIcon}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.userImage} />
              ) : (
                <Ionicons name="person" size={24} color="white" />
              )}
            </View>
            <View style={styles.userMarkerTriangle} />
          </View>
        </Marker>

        {/* Provider Pins */}
        {MOCK_PROVIDERS.map((provider) => {
          const isSelected = selectedProviderId === provider.id;
          const coordinate = {
            latitude: location.coords.latitude + provider.latOffset,
            longitude: location.coords.longitude + provider.lngOffset,
          };

          return (
            <Marker 
              key={provider.id} 
              coordinate={coordinate} 
              onPress={(e) => {
                e.stopPropagation();
                setSelectedProviderId(provider.id);
              }}
              zIndex={isSelected ? 10 : 1}
            >
              {isSelected ? (
                // Expanded State
                <View style={styles.expandedMarker}>
                  <Image source={{ uri: provider.image }} style={styles.expandedImage} />
                  <View style={styles.expandedTextContainer}>
                    <Text style={styles.expandedName}>{provider.name}</Text>
                    <Text style={styles.expandedDistance}>{provider.distance}</Text>
                  </View>
                </View>
              ) : (
                // Collapsed State
                <View style={styles.providerMarker}>
                  <Image source={{ uri: provider.image }} style={styles.providerImage} />
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={10} color="white" />
                    <Text style={styles.ratingText}>{provider.rating}</Text>
                  </View>
                </View>
              )}
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Filter Button */}
      <TouchableOpacity 
        style={[styles.filterButton, { top: insets.top + 16 }]}
        activeOpacity={0.8}
      >
        <Text style={styles.filterText}>Filter</Text>
        <Ionicons name="funnel-outline" size={16} color="black" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    width: width,
    height: height,
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  userImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  userMarkerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1f2937',
    transform: [{ rotate: '180deg' }],
    marginTop: -4,
    zIndex: 1,
  },
  providerMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 8, // space for badge
  },
  providerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'white',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  ratingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  expandedMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 160,
  },
  expandedImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  expandedTextContainer: {
    marginLeft: 10,
    marginRight: 14,
    justifyContent: 'center',
  },
  expandedName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
  },
  expandedDistance: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  filterButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginRight: 6,
  }
});
