import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Table,
  Button,
  Spinner,
  Alert,
  Navbar,
  ProgressBar,
} from 'react-bootstrap';
import { FaSync, FaChartLine, FaInfoCircle } from 'react-icons/fa';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function formatCurrency(n, digits = 2) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function App() {
  const [arbitrageData, setArbitrageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [feeRate, setFeeRate] = useState(0.2); // percentage (0.2 == 0.2%)
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState({ key: 'price_diff_pct', desc: true });
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showAll, setShowAll] = useState(false);
  const [investment, setInvestment] = useState(1000);

  const fetchArbitrageData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/arbitrage`);
      const data = Array.isArray(response.data) ? response.data : [];
      // Defensive: ensure numeric fields exist
      const normalized = data.map((d) => ({
        token: d.token || 'UNKNOWN',
        buy_exchange: d.buy_exchange || '-',
        sell_exchange: d.sell_exchange || '-',
        buy_price: Number(d.buy_price) || 0,
        sell_price: Number(d.sell_price) || 0,
        price_diff_pct: Number(d.price_diff_pct) || 0,
        profit_per_1000_usd: Number(d.profit_per_1000_usd) || 0,
      }));
      setArbitrageData(normalized);
      setLastUpdate(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError('API error: ' + (err.message || err));
      setArbitrageData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArbitrageData();
    const interval = setInterval(fetchArbitrageData, 300000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const calculateProfit = (investment, buyPrice, sellPrice) => {
    const units = buyPrice > 0 ? investment / buyPrice : 0;
    const value = units * sellPrice;
    const gross = value - investment;
    const fees = -((feeRate / 100) * investment * 2);
    const net = gross + fees;
    const roi = investment > 0 ? (net / investment) * 100 : 0;
    return {
      investment: formatCurrency(investment, 0),
      units: units.toFixed(6),
      value: formatCurrency(value),
      gross: formatCurrency(gross),
      fees: formatCurrency(fees),
      net: formatCurrency(net),
      roi: `${roi.toFixed(2)}%`,
    };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return arbitrageData.filter((r) => {
      if (!q) return true;
      return (
        r.token.toLowerCase().includes(q) ||
        r.buy_exchange.toLowerCase().includes(q) ||
        r.sell_exchange.toLowerCase().includes(q)
      );
    });
  }, [arbitrageData, query]);

  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      const aVal = a[sortBy.key];
      const bVal = b[sortBy.key];
      if (aVal === bVal) return 0;
      return sortBy.desc ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });
    return data;
  }, [filtered, sortBy]);

  const top = sorted[0];

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Fetching latest arbitrage data...</p>
      </Container>
    );
  }

  return (
    <div className={`app-wrapper ${theme}`}>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">
            <FaChartLine className="me-2" /> Crypto Arbitrage Dashboard
          </Navbar.Brand>
          <div className="d-flex gap-2 align-items-center ms-auto">
            <small className="text-muted">Last: {lastUpdate ? new Date(lastUpdate).toLocaleString() : '—'}</small>
            <Button variant="outline-light" onClick={fetchArbitrageData} aria-label="refresh">
              <FaSync className="me-1" /> Refresh
            </Button>
            <Button variant="outline-light" className="ms-2 theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="toggle theme">
              {theme === 'light' ? <FaSun /> : <FaMoon />}
            </Button>
          </div>
        </Container>
      </Navbar>

      {/* Top banner showing latest update more prominently */}
      <Container fluid className="app-update-strip mb-3">
        <Container className="d-flex justify-content-between align-items-center py-2">
          <div className="d-flex align-items-center gap-2">
            <FaChartLine />
            <strong>Latest update:</strong>
            <span className="text-muted">{lastUpdate ? new Date(lastUpdate).toLocaleString() : '—'}</span>
          </div>
          <div className="text-muted small">Auto-refresh: every 5 minutes</div>
        </Container>
      </Container>

      <Container fluid className="app-container">
        <Row>
          <Col lg={3} className="sidebar">
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>
                  About <FaInfoCircle className="ms-2 text-secondary" />
                </Card.Title>
                <Card.Text className="small text-muted">
                  Monitors real-time arbitrage across major exchanges for USDT pairs. The dashboard highlights potential price differences between exchanges and provides quick profit estimates. Data is informational — always do your own research before trading.
                </Card.Text>
                <hr />
                <Form.Group className="mb-2">
                  <Form.Label>Search tokens / exchanges</Form.Label>
                  <Form.Control placeholder="e.g. BTC, Binance" value={query} onChange={(e) => setQuery(e.target.value)} />
                </Form.Group>
                {/* Fee slider removed from sidebar per request */}
                <div className="d-flex gap-2 mt-3">
                  <Button variant="primary" onClick={() => setSortBy({ key: 'price_diff_pct', desc: true })}>Sort: Spread</Button>
                  <Button variant="outline-secondary" onClick={() => setSortBy({ key: 'profit_per_1000_usd', desc: true })}>Sort: Profit</Button>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Body>
                <Card.Title>Metrics</Card.Title>
                <div className="metric-list">
                  <div className="metric-item">
                    <div className="metric-title">Opportunities</div>
                    <div className="metric-value">{arbitrageData.length}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-title">Max Spread</div>
                    <div className="metric-value">{arbitrageData.length ? Math.max(...arbitrageData.map(d => d.price_diff_pct)).toFixed(2) + '%' : '—'}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-title">Avg Spread</div>
                    <div className="metric-value">{arbitrageData.length ? (arbitrageData.reduce((s, r) => s + r.price_diff_pct, 0) / arbitrageData.length).toFixed(2) + '%' : '—'}</div>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="mt-3">
              <Card.Body>
                <div className="d-flex align-items-center gap-2">
                  <FaTelegramPlane />
                  <a href="https://t.me/arb_spotter_bot" target="_blank" rel="noreferrer">Telegram Bot</a>
                </div>
                <hr />
                <div className="small text-muted">Built by <a href="https://x.com/danny_4reel" target="_blank" rel="noreferrer">Daniel Amah</a>, for educational purposes.</div>
                <div className="small text-muted mt-2">Links: <FaTwitter className="ms-1" /> <a href="https://x.com/danny_4reel" target="_blank" rel="noreferrer">@danny_4reel</a></div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={9} className="main-content">
            <Row className="mb-3">
              <Col>
                <h2 className="mb-0">Top Opportunities</h2>
                <p className="text-muted small">Filtered: {sorted.length} • Showing best first</p>
              </Col>
            </Row>

            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            {sorted.length === 0 ? (
              <Alert variant="warning">No opportunities match your filters.</Alert>
            ) : (
              <Card className="mb-4">
                <Card.Body className="p-2">
                  <Table responsive hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>Buy @</th>
                        <th>Sell @</th>
                        <th className="text-end">Spread</th>
                        <th className="text-end">Profit / $1k</th>
                        <th className="text-end">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAll ? sorted : sorted.slice(0, 6)).map((r, i) => (
                        <tr key={`${r.token}-${i}`} className={i === 0 ? 'table-highlight' : ''}>
                          <td>
                            <div className="token-name">{r.token}</div>
                            <div className="text-muted small">{r.buy_exchange} → {r.sell_exchange}</div>
                          </td>
                          <td>{formatCurrency(r.buy_price, 6)} <div className="small text-muted">{r.buy_exchange}</div></td>
                          <td>{formatCurrency(r.sell_price, 6)} <div className="small text-muted">{r.sell_exchange}</div></td>
                          <td className="text-end">
                            <div>{r.price_diff_pct.toFixed(2)}%</div>
                            <ProgressBar now={Math.min(Math.max(r.price_diff_pct, 0), 10)} max={10} style={{ height: 8 }} />
                          </td>
                          <td className="text-end">{formatCurrency(r.profit_per_1000_usd)}</td>
                          <td className="text-end">{((r.profit_per_1000_usd / 1000) * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {sorted.length > 6 && (
                    <div className="text-center mt-2">
                      <Button variant="link" onClick={() => setShowAll(!showAll)}>
                        {showAll ? (<><FaChevronUp /> Show less</>) : (<><FaChevronDown /> Show more</>)}
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {top && (
              <Card className="mb-4 best-opp-card">
                <Card.Header><strong>Best Opportunity: {top.token}</strong></Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4} className="d-flex flex-column justify-content-center">
                      <div className="big-number">{top.price_diff_pct.toFixed(2)}%</div>
                      <div className="text-muted small">Spread</div>
                    </Col>
                    <Col md={8}>
                      <div className="d-flex justify-content-between mb-2">
                        <div><strong>Buy</strong> {top.buy_exchange} • {formatCurrency(top.buy_price, 6)}</div>
                        <div><strong>Sell</strong> {top.sell_exchange} • {formatCurrency(top.sell_price, 6)}</div>
                      </div>
                      <div className="mb-2">Estimated profit per $1,000: <strong>{formatCurrency(top.profit_per_1000_usd)}</strong></div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            <Card>
              <Card.Body>
                <Card.Title>Profit Analysis</Card.Title>
                {top ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="small text-muted">Based on top opportunity: <strong>{top.token}</strong></div>
                      <div className="d-flex gap-3 align-items-center profit-controls">
                        <div className="text-end small">
                          <div>Fees %</div>
                          <div className="fw-bold">{feeRate.toFixed(1)}%</div>
                        </div>
                        <div className="slider-group">
                          <Form.Range min={0} max={1.5} step={0.1} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} />
                        </div>
                        <div className="text-end small">
                          <div>Investment</div>
                          <div className="fw-bold">{formatCurrency(investment, 0)}</div>
                        </div>
                        <div className="slider-group">
                          <Form.Range min={100} max={10000} step={100} value={investment} onChange={(e) => setInvestment(Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    <Table bordered size="sm" className="profit-table attractive">
                      <thead>
                        <tr>
                          <th>Investment</th>
                          <th>Units</th>
                          <th>Value</th>
                          <th>Gross</th>
                          <th>Fees</th>
                          <th>Net</th>
                          <th>ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[investment, investment * 5, investment * 10].map((inv) => {
                          const p = calculateProfit(inv, top.buy_price, top.sell_price);
                          return (
                            <tr key={inv}>
                              <td className="fw-bold">{p.investment}</td>
                              <td>{p.units}</td>
                              <td className="text-muted">{p.value}</td>
                              <td className="text-success">{p.gross}</td>
                              <td className="text-danger">{p.fees}</td>
                              <td className="text-primary">{p.net}</td>
                              <td className="fw-bold">{p.roi}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </>
                ) : (
                  <Alert variant="secondary">No data to analyze.</Alert>
                )}
              </Card.Body>
            </Card>

            <hr className="my-4" />
            <footer className="text-center text-muted">Data from CoinGecko API. Not financial advice.</footer>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;