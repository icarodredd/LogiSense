# Integrações Externas — LogiSense

## Visão geral

A LogiSense consome pelo menos duas APIs externas, ambas encapsuladas no backend:

| Provedor | Finalidade | Endpoint base |
|---|---|---|
| **ViaCEP** | Consulta de endereço por CEP (preenchimento/validação de formulários) | `https://viacep.com.br/ws/{CEP}/json/` |
| **Open-Meteo** | Condições climáticas para origem/destino (indicador de risco operacional) | `https://api.open-meteo.com/v1/forecast` |

O frontend **nunca** chama esses provedores diretamente — todas as regras e transformações ficam no backend.

---

## ViaCEP

### Endpoint

```text
GET /api/integrations/cep/:cep
```

### Fluxo

1. Recebe o CEP via path param (8 dígitos, sem formatação);
2. Normaliza (remove hífen/pontos);
3. Valida formato (`/^\d{8}$/`);
4. Chama ViaCEP;
5. Retorna DTO com: `cep`, `logradouro`, `complemento`, `bairro`, `localidade`, `uf`, `ibge`, `ddd`.

### Erros

| Código | Quando |
|---|---|
| `INVALID_CEP` | Formato inválido (não 8 dígitos) |
| `CEP_NOT_FOUND` | CEP inexistente no ViaCEP |
| `CEP_SERVICE_ERROR` | Erro HTTP na chamada ao ViaCEP |

### Uso no produto

- Ao criar/editar um Customer, o frontend pode chamar esse endpoint para preencher automaticamente os campos de endereço (logradouro, bairro, cidade, estado).

---

## Open-Meteo

### Endpoint

```text
GET /api/integrations/weather?lat=-23.55&lon=-46.65
```

### Fluxo

1. Recebe `lat` e `lon` como query params;
2. Valida range: lat ∈ [-90, 90], lon ∈ [-180, 180];
3. Chama Open-Meteo com `current_weather=true`;
4. Retorna DTO com: `temperature` (°C), `windspeed` (km/h), `weathercode` (WMO), `time` (ISO).

### Erros

| Código | Quando |
|---|---|
| `INVALID_LATITUDE` | Latitude fora do range |
| `INVALID_LONGITUDE` | Longitude fora do range |
| `WEATHER_SERVICE_UNAVAILABLE` | Erro HTTP no serviço externo |
| `WEATHER_NO_DATA` | Sem dados de clima para as coordenadas |

### Uso no produto

- Em desenvolvimento: base para indicadores de risco climático em simulações (futuro).

---

## Arquitetura

```text
Frontend → POST /api/integrations/cep/:cep
                → GET /api/integrations/weather?lat=&lon=
                        ↓
              IntegrationsController
                        ↓
              IntegrationsService
               ├── lookupCep() → fetch(ViaCEP)
               └── getWeather() → fetch(Open-Meteo)
                        ↓
              DTOs de resposta
```

### Princípios

- **Encapsulação**: APIs externas chamadas apenas pelo backend.
- **Sem secrets**: Ambas as APIs são públicas (não requerem chaves).
- **Erros padronizados**: Mesmo envelope `{ statusCode, code, message, timestamp, requestId }`.
- **Sem tempo de execução síncrono na requisição principal**: As chamadas são rápidas (sub-segundo), então ficam síncronas por enquanto.

---

## DTOs de resposta

### CepResponse

```json
{
  "cep": "01000000",
  "logradouro": "Praça da Sé",
  "complemento": "lado ímpar",
  "bairro": "Sé",
  "localidade": "São Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "gia": "1004",
  "ddd": "11"
}
```

### WeatherResponse

```json
{
  "temperature": 22.5,
  "windspeed": 15.3,
  "weathercode": 1,
  "time": "2026-09-14T12:00:00Z"
}
```
