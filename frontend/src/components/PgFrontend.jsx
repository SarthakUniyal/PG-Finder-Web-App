import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { Card, Button, Row, Col, Container } from 'react-bootstrap';
import API_BASE_URL from '../config/api';
import "../style/PG.scss"
const PgFrontend = () => {
  const [pg, setPG]=useState([]);
  useEffect(()=>{
    axios.get(`${API_BASE_URL}/pg`)
    .then((response)=>{
        setPG(response.data);
    })
    .catch((error)=>{
        console.error("Error fetching Rooms!",error);
    });
    
  },)
  
    return (
    <>
        <div className='lodging-section'>
            <div className='lodging-header'>
                <h1 className='lodging-title'>Lodging avaliable</h1>
            </div>
            <Container fluid className="lodging-cards-container">
                <Row className="g-3">
                    {pg.map((suite)=>(
                        <Col
                            key={suite._id}
                            xs={12}
                            sm={6}
                            md={4}
                            lg={3}
                        >
                            <Card className="h-100 lodging-card">
                                <Card.Img
                                    variant="top"
                                    src={suite.imageUrl || '/house_not_found.png'}
                                    alt={`${suite.name}`}
                                    className="lodging-card-img"
                                />
                                <Card.Body className="d-flex flex-column">
                                    <Card.Title className="mb-3">
                                        {suite.landmaerk}
                                    </Card.Title>
                                    <Card.Title className="mb-3">
                                        {suite.city}
                                    </Card.Title>
                                    <Card.Subtitle className="mb-3 text-muted">
                                        {suite.title}
                                    </Card.Subtitle>
                                    <Card.Text className="mb-3">
                                        {suite.area}
                                    </Card.Text>
                                    <Card.Text className="mb-3">
                                        <p>Rooms : 
                                            {suite.rooms.bedrooms} bedrooms
                                            {suite.rooms.washroom} washroom 
                                        </p>
                                    </Card.Text>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Container>
        </div>

    </>
  )
}

export default PgFrontend