import { useState } from "react";
import axios from "axios";
import API_BASE_URL from '../config/api';

const InsertPG = () => {
  
    const [hNo, setHNo]=useState("");
  const [landmark, setLandmark]=useState("");
  const [type, setType]=useState("");
  const [city, setCity]=useState("");
  const [area,setArea]=useState("");
  const [bedrooms, setBedrooms]=useState(0);
  const [washroom, setWashrooms]=useState(0);
  const [available, setAvailable]=useState(true);
  const [message, setMessage]=useState("");
  const [image, setImage]=useState(null);

    const handleSubmit=async(event)=>{
        event.preventDefault(); 
        try{  
            const formData=new FormData();
            formData.append('h_no',hNo);
            formData.append('landmark',landmark);
            formData.append('type',type);
            formData.append('city',city);
            formData.append('area',area);
            formData.append('bedrooms',bedrooms);
            formData.append('washroom',washroom);
            formData.append('available',available);

            if(image) formData.append('image',image);

            const response = await axios.post(`${API_BASE_URL}/pg/`,formData,{
                headers:{
                    'Content-type':'multipart/form-data'
                }
            });
            setMessage(response.data.message || "PG registered successfullyt");

            setLandmark("");
            setType("");
            setCity("");
            setArea("");
            setBedrooms(0);
            setWashrooms(0);
            setAvailable("");
            setAvailable("true");
            setImage(null);

        }catch(error){
            console.log("Error registering PG: ",error);
            setMessage("Failed to register PG");
        }
    }
  
    return (
    <>
        <div className="insert-pg-container">
            <div className="insert-pg-message">{message}</div>
            <form action="" onSubmit={handleSubmit} className="insert-pg-form">
                 <div>
                    <label className="insert-pg-label">House NUmber: </label>
                    <input
                        className="form-control" 
                        type="text" 
                        placeholder="House Number"
                        value={hNo}
                        onChange={(e)=>setHNo(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">LandMark: </label>
                    <input
                        className="form-control" 
                        type="text" 
                        placeholder="nearest famous building"
                        value={landmark}
                        onChange={(e)=>setLandmark(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">Room Type: </label>
                    <input
                        className="form-control" 
                        type="text" 
                        placeholder="1bhk / independent shared"
                        value={type}
                        onChange={(e)=>setType(e.target.value)}
                        required
                        />
                </div>
                <div>
                    <label className="insert-pg-label">City: </label>
                    <input
                        className="form-control" 
                        type="text" 
                        placeholder="delhi / bombay ?"
                        value={city}
                        onChange={(e)=>setCity(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">Area: </label>
                    <input
                        className="form-control" 
                        type="text" 
                        placeholder="neighbourhood / locality"
                        value={area}
                        onChange={(e)=>setArea(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">Bedrooms: </label>
                    <input
                        className="form-control" 
                        type="number" 
                        placeholder="Number of Bedrooms"
                        value={bedrooms}
                        onChange={(e)=>setBedrooms(Number(e.target.value))}
                        min="0"
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">Washrooms: </label>
                    <input
                        className="form-control" 
                        type="number" 
                        placeholder="Number of Washroom"
                        value={washroom}
                        onChange={(e)=>setWashrooms(Number(e.target.value))}
                        min="0"
                        required
                    />
                </div>
                <div>
                    <label className="insert-pg-label">Avaliablity: </label>
                    <select
                        className="form-select"
                        type="text"
                        placeholder="vacant ?" 
                        value={available}
                        onChange={(e)=>setAvailable(e.target.value)}
                        required
                    >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </div>
                <div>
                    <label className="insert-pg-label">Image: </label>
                    <input 
                        className="form-control"
                        type="file" 
                        accept="image/*"
                        onChange={(e)=>setImage(e.target.files[0])}
                    />
                </div>
                <button
                    className="insert-pg-submit-btn"
                    type="submit"
                >Sumbit PG</button>
            </form>
        </div>
    </>
  )
}

export default InsertPG