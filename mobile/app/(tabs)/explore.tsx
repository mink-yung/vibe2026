import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";

const STYLIST_URL = "https://mink-yung.github.io/vibe2026/stylist.html";

export default function StylistWebScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <WebView source={{ uri: STYLIST_URL }} style={styles.webview} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  webview: { flex: 1 },
});
