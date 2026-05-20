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
      // Check cache first to avoid rate limits
      const cachedLocation = await SecureStore.getItemAsync('cachedLocationName');
      if (cachedLocation) {
        setLocationName(cachedLocation);
        return; // Skip API call if we have a cached value
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const state = address.region || address.city || "Unknown State";
        const country = address.country || "Unknown Country";
        const formattedName = `${state}, ${country}`;
        setLocationName(formattedName);
        
        // Cache it for future app loads
        await SecureStore.setItemAsync('cachedLocationName', formattedName);
      }
    } catch (error: any) {
      console.error("Error fetching location name", error);
      // Fallback if rate limited or failed
      setLocationName("Location unavailable");
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
