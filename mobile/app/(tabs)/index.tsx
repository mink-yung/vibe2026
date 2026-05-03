import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";

// Cloudflare Worker 배포 후 URL을 교체하세요
const WORKER_URL = "https://YOUR_WORKER.workers.dev";

const FACE_SHAPES = ["계란형", "둥근형", "각진형", "하트형", "긴형", "다이아몬드형"];

export default function HomeScreen() {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [faceShape, setFaceShape] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!height || !weight || !faceShape) {
      setError("키, 몸무게, 얼굴형을 모두 입력해주세요.");
      return;
    }
    setError("");
    setResult("");
    setLoading(true);

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height, weight, faceShape }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI 퍼스널 스타일리스트</Text>
          <Text style={styles.subtitle}>나에게 맞는 퍼스널 컬러와 패션을 추천받아보세요</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 170"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
              maxLength={3}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>몸무게 (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 60"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
              maxLength={3}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>얼굴형</Text>
            <View style={styles.chips}>
              {FACE_SHAPES.map((shape) => (
                <TouchableOpacity
                  key={shape}
                  style={[styles.chip, faceShape === shape && styles.chipActive]}
                  onPress={() => setFaceShape(shape)}
                >
                  <Text style={[styles.chipText, faceShape === shape && styles.chipTextActive]}>
                    {shape}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>추천받기</Text>
            )}
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✨ 스타일 추천 결과</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f5f5" },
  container: { padding: 20, paddingBottom: 40 },

  header: { marginTop: 20, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#111", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#666" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 8 },

  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
  },
  chipActive: { borderColor: "#5a67d8", backgroundColor: "#eef0fb" },
  chipText: { fontSize: 13, color: "#555" },
  chipTextActive: { color: "#5a67d8", fontWeight: "600" },

  error: { color: "#e53e3e", fontSize: 13, marginBottom: 12 },

  button: {
    backgroundColor: "#5a67d8",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: "#a0a8e8" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  resultTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 12 },
  resultText: { fontSize: 14, color: "#333", lineHeight: 22 },
});
