// Web stand-in for react-native-maps, which only runs on iOS/Android.
// Shows a placeholder box where the map would be; the list of centers still works.
import React from "react";
import { Text, View } from "react-native";

function MapView({ style }) {
  return React.createElement(
    View,
    {
      style: [
        style,
        { alignItems: "center", justifyContent: "center", backgroundColor: "#eef3ee" },
      ],
    },
    React.createElement(
      Text,
      { style: { color: "#555", textAlign: "center", padding: 12 } },
      "Map view is available in the mobile app."
    )
  );
}

export function Marker() {
  return null;
}
export function Callout() {
  return null;
}
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = null;
export default MapView;
