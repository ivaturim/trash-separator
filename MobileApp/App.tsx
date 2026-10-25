import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";

import VoiceFab from "./src/components/VoiceFab";
import { navigationRef } from "./src/navigation/ref";
import type { RootStackParamList } from "./src/navigation/types";
import BarcodeResultScreen from "./src/screens/BarcodeResultScreen";
import BarcodeScannerScreen from "./src/screens/BarcodeScannerScreen";
import CenterDetailScreen from "./src/screens/CenterDetailScreen";
import ChatScreen from "./src/screens/ChatScreen";
import GuidedModeScreen from "./src/screens/GuidedModeScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ImpactScreen from "./src/screens/ImpactScreen";
import LanguageSettingsScreen from "./src/screens/LanguageSettingsScreen";
import NearbyCentersScreen from "./src/screens/NearbyCentersScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import VoiceModeOverlay from "./src/screens/VoiceModeOverlay";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { VoiceModeProvider } from "./src/voice/VoiceModeContext";

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const titleStyle = {
    color: theme.colors.text,
    fontWeight: "800" as const,
    fontFamily: theme.fontFamily,
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <VoiceModeProvider>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.background },
            headerTitleStyle: titleStyle,
            headerTintColor: theme.colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.background },
            headerBackTitle: t("common.back"),
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: t("chat.title") }}
          />
          <Stack.Screen
            name="Impact"
            component={ImpactScreen}
            options={{ title: t("impact.title") }}
          />
          <Stack.Screen
            name="GuidedMode"
            component={GuidedModeScreen}
            options={{ headerShown: false, presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: t("settings.title") }}
          />
          <Stack.Screen
            name="LanguageSettings"
            component={LanguageSettingsScreen}
            options={{ title: t("language.title") }}
          />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{ headerShown: false, presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="BarcodeResult"
            component={BarcodeResultScreen}
            options={{ title: t("barcode.title") }}
          />
          <Stack.Screen
            name="NearbyCenters"
            component={NearbyCentersScreen}
            options={{ title: t("nearby.title") }}
          />
          <Stack.Screen
            name="CenterDetail"
            component={CenterDetailScreen}
            options={{ title: t("nearby.centerTitle") }}
          />
        </Stack.Navigator>
        <VoiceModeOverlay />
        <VoiceFab />
      </VoiceModeProvider>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
