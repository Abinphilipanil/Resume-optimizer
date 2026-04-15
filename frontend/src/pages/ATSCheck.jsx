const API = import.meta.env.VITE_API_URL
import { useNavigate } from "react-router-dom";

function ATSCheck() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-content center">
        <h2>Run ATS Check</h2>

        <button
          className="btn-primary"
          onClick={() => navigate("/loading")}
        >
          Check Now
        </button>
      </div>
    </div>
  );
}

export default ATSCheck;
