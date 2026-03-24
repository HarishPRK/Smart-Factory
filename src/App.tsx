import { FilterProvider } from "./context/FilterContext";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <FilterProvider>
      <Dashboard />
    </FilterProvider>
  );
}

export default App;
