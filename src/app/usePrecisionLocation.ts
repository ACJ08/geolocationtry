import { useState, useEffect, useRef, useCallback } from "react";

interface LocationState {
  status: "idle" | "warming_up" | "acquiring" | "locked" | "error";
  errorMsg: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number;
  readingsCount: number;
}

export function usePrecisionLocation(maxWaitMs = 15000, requiredAccuracy = 20) {
  const [state, setState] = useState<LocationState>({
    status: "idle",
    errorMsg: null,
    lat: null,
    lng: null,
    accuracy: 999,
    readingsCount: 0,
  });

  const watchIdRef = useRef<number | null>(null);
  const samplesRef = useRef<GeolocationPosition[]>([]);
  const startTimeRef = useRef<number>(0);

  // Haversine distance in meters
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, status: "error", errorMsg: "Geolocation not supported." }));
      return;
    }

    setState({ status: "warming_up", errorMsg: null, lat: null, lng: null, accuracy: 999, readingsCount: 0 });
    samplesRef.current = [];
    startTimeRef.current = Date.now();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentAccuracy = pos.coords.accuracy;

        // 1. HARDWARE WARM-UP: Discard the first 2 seconds of data entirely
        if (elapsed < 2000) return;

        // 2. SPIKE/JUMP DETECTION: Compare with previous valid sample
        if (samplesRef.current.length > 0) {
          const prev = samplesRef.current[samplesRef.current.length - 1];
          const dist = getDistance(prev.coords.latitude, prev.coords.longitude, pos.coords.latitude, pos.coords.longitude);
          const timeDiff = (pos.timestamp - prev.timestamp) / 1000;
          const speed = timeDiff > 0 ? dist / timeDiff : 0;
          
          // Reject impossible human speed (> 7m/s) if accuracy is poor
          if (speed > 7 && currentAccuracy > 15) return; 
        }

        // Reject objectively terrible readings immediately
        if (currentAccuracy > 100) return;

        samplesRef.current.push(pos);
        
        // 3. WEIGHTED AVERAGE CALCULATION
        let totalWeight = 0, wLat = 0, wLng = 0, bestAcc = Infinity;

        samplesRef.current.forEach(sample => {
          // Weight = 1 / Variance
          const weight = 1 / Math.pow(sample.coords.accuracy, 2);
          totalWeight += weight;
          wLat += sample.coords.latitude * weight;
          wLng += sample.coords.longitude * weight;
          if (sample.coords.accuracy < bestAcc) bestAcc = sample.coords.accuracy;
        });

        const averagedLat = wLat / totalWeight;
        const averagedLng = wLng / totalWeight;

        // 4. CHECK LOCK CONDITIONS
        const hasEnoughSamples = samplesRef.current.length >= 4;
        const isHighlyAccurate = bestAcc <= requiredAccuracy;
        
        if (hasEnoughSamples && isHighlyAccurate) {
          stopTracking();
          setState({
            status: "locked",
            errorMsg: null,
            lat: averagedLat,
            lng: averagedLng,
            accuracy: bestAcc,
            readingsCount: samplesRef.current.length,
          });
        } else {
          setState({
            status: "acquiring",
            errorMsg: null,
            lat: averagedLat,
            lng: averagedLng,
            accuracy: bestAcc,
            readingsCount: samplesRef.current.length,
          });
        }
      },
      (err) => {
        stopTracking();
        setState(prev => ({ 
          ...prev, 
          status: "error", 
          errorMsg: err.code === 1 ? "Location permission denied." : "Lost GPS signal." 
        }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    // 5. SAFETY TIMEOUT: Force resolution after maxWaitMs
    setTimeout(() => {
      if (watchIdRef.current !== null) {
        stopTracking();
        if (samplesRef.current.length > 0) {
           // Settle for what we have
           setState(prev => ({ ...prev, status: "locked" }));
        } else {
           setState(prev => ({ ...prev, status: "error", errorMsg: "Could not acquire stable location. Try turning on Wi-Fi or stepping outside." }));
        }
      }
    }, maxWaitMs);

  }, [maxWaitMs, requiredAccuracy, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  return { locationState: state, startTracking, stopTracking };
}