import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

type LocationContextType = {
  hasLocationPermission: boolean | null;
  locationName: string | null;
  requestPermission: () => Promise<void>;
  showModal: boolean;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const checkLocationStatus = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');

      if (status !== 'granted') {
        setShowModal(true);
      } else {
        setShowModal(false);
        await fetchLocationName();
      }
    } catch (error) {
      console.error("Failed to check location status", error);
    }
  };

  const fetchLocationName = async () => {
    try {
      // 1. Instantly load from cache so the UI doesn't lag
      let hasCachedLocation = false;
      const cachedLocation = await SecureStore.getItemAsync('cachedLocationName');
      if (cachedLocation) {
        setLocationName(cachedLocation);
        hasCachedLocation = true;
      }

      // 2. Perform a background check for updated location
      // Try to get last known position first (fast)
      let location = await Location.getLastKnownPositionAsync();
      
      // Fallback to current position if no last known position (slower)
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (location) {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (address) {
          const state = address.region || address.city || "Unknown State";
          const country = address.country || "Unknown Country";
          const formattedName = `${state}, ${country}`;
          
          // Only update state and cache if it's different or we had no cache
          if (formattedName !== cachedLocation) {
            setLocationName(formattedName);
            await SecureStore.setItemAsync('cachedLocationName', formattedName);
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching location name", error);
      // Fallback: only show "unavailable" if we don't even have a cached location
      const cachedLocation = await SecureStore.getItemAsync('cachedLocationName');
      if (!cachedLocation) {
        setLocationName("Location unavailable");
      }
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        setShowModal(false);
        await fetchLocationName();
      }
      // If denied, showModal remains true
    } catch (error) {
      console.error("Error requesting location permission", error);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        hasLocationPermission,
        locationName,
        requestPermission,
        showModal,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
