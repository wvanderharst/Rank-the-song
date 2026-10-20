import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Text } from "react-native";

import GameScreen from "@/screens/GameScreen";
import ChainGameScreen from "@/screens/ChainGameScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SongListScreen from "@/screens/SongListScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/context/SettingsContext";

export type RootStackParamList = {
  Game: undefined;
  ChainGame: undefined;
  Settings: undefined;
  SongList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function GameRouter() {
  const { gameMode } = useSettings();
  
  if (gameMode === "simple") {
    return <GameScreen />;
  }
  return <ChainGameScreen />;
}

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { gameMode } = useSettings();

  const getHeaderTitle = () => {
    switch (gameMode) {
      case "singleplayer":
        return "Chain Game";
      case "team":
        return "Team Mode";
      default:
        return "Rank The Song";
    }
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Game"
        options={({ navigation }) => ({
          headerTitle: () => <HeaderTitle title={getHeaderTitle()} />,
          headerRight: () => (
            <HeaderButton
              onPress={() => navigation.navigate("Settings")}
              pressColor={theme.primary}
              pressOpacity={0.7}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Settings</Text>
            </HeaderButton>
          ),
        })}
      >
        {() => <GameRouter />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={({ navigation }) => ({
          presentation: "modal",
          headerTitle: "Settings",
          headerLeft: () => (
            <HeaderButton
              onPress={() => navigation.goBack()}
              pressColor={theme.primary}
              pressOpacity={0.7}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Close</Text>
            </HeaderButton>
          ),
        })}
      />
      <Stack.Screen
        name="SongList"
        component={SongListScreen}
        options={({ navigation }) => ({
          headerTitle: "Song Lists",
          headerLeft: () => (
            <HeaderButton
              onPress={() => navigation.goBack()}
              pressColor={theme.primary}
              pressOpacity={0.7}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Back</Text>
            </HeaderButton>
          ),
        })}
      />
    </Stack.Navigator>
  );
}
