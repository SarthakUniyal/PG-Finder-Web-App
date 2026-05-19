import React,{useEffect, useState} from 'react'
import axios from 'axios';
import API_BASE_URL from '../../config/api';
import '../../style/PdrCntnt.scss';

const PrdCntnt = () => {
  
  const [room, setRoom]=useState([]);
  useEffect(()=>{
    axios
        .get(`${API_BASE_URL}/rooms`)
        .then((response)=>{
            setRoom(response.data);
        })
        .catch((error)=>{
            console.error("Error fetching Room data", error);
        });
  });
    return (
    <>
        <div className='room-main-container'>
            <h1 className='room-main-title'>Rooms</h1>
        </div>
        <div className='container-fluid room-grid-wrapper'>
            <div className='row g-4 room-cards-row'>
                {room.map((room)=>(
                    <div className='card h-100 room-card shadow-sm'>
                        <img 
                            src="" 
                            alt="" 
                            className='card-img-top room-image'    
                        />
                        <div className='card-body room-card-content'>
                            <h5 className='card-title room-type'>
                                Type : <strong>{room.type}</strong>
                            </h5>
                            <p className='card-text room-detail'>
                                <small className='text-muted'>Brand: {room.brand}</small>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
  )
}

export default PrdCntnt