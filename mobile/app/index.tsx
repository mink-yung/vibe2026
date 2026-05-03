import { View, Text, StyleSheet, Pressable, Alert } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🚀</Text>
      <Text style={styles.title}>Expo 연결 성공!</Text>
      <Text style={styles.subtitle}>
        지금 이 화면은 JupyterLab에서 수정한 코드입니다.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => Alert.alert("성공", "버튼도 잘 작동합니다!")}
      >
        <Text style={styles.buttonText}>눌러보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
});
