import { AuthProvider } from "./src/auth";
import { RootNavigator } from "./src/screens/RootNavigator";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}