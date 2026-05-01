import { useState, useEffect } from 'react'
import axios from 'axios'

interface Product {
  id: string;
  name: string;
  basePrice: number;
  type: string;
  isActive: boolean;
}

interface SpringPageResponse {
  content: Product[];
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [erroMensagem, setErroMensagem] = useState<string | null>(null)

  useEffect(() => {
    const username = 'felipe.vitalis'
    const password = 'senhaSegura123'
    // btoa é mais seguro para ambientes web/electron modernos
    const token = window.btoa(`${username}:${password}`)

    axios.get<SpringPageResponse>('http://localhost:8080/products', {
      headers: {
        'Authorization': `Basic ${token}`
      }
    })
      .then(response => {
        setProducts(response.data.content || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setErroMensagem("Erro ao conectar com o Backend Java. Verifique o CORS ou se o servidor está rodando.")
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ padding: '30px', color: '#eee', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1>Vitalis - Gestão de Depósito</h1>
      <hr style={{ borderColor: '#444' }} />
      
      {loading && <p>Carregando...</p>}
      {erroMensagem && <p style={{ color: '#ff6b6b' }}>{erroMensagem}</p>}

      {!loading && !erroMensagem && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #444' }}>
              <th style={{ padding: '10px' }}>Nome</th>
              <th>Preço</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '10px' }}>{p.name}</td>
                <td>R$ {p.basePrice.toFixed(2)}</td>
                <td>{p.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default App