#!/bin/bash
# add ts node

# Função para verificar e instalar Node.js
install_node() {
    if command -v node &>/dev/null; then
        echo "Node.js já está instalado."
    else
        echo "Node.js não está instalado. Instalando..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt update
            sudo apt install -y nodejs npm
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install node@20
            brew link node@20
        elif [[ "$OSTYPE" == "msys" ]]; then
            echo "Por favor, instale o Node.js manualmente no Windows: https://nodejs.org/"
        fi
    fi
}

# Função para verificar e instalar Docker
install_docker() {
    if command -v docker &>/dev/null; then
        echo "Docker já está instalado."
    else
        echo "Docker não está instalado. Instalando..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt update
            sudo apt install -y docker.io
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install --cask docker
        elif [[ "$OSTYPE" == "msys" ]]; then
            echo "Por favor, instale o Docker manualmente no Windows: https://docs.docker.com/docker-for-windows/install/"
        fi
    fi
}

# Função para verificar e instalar Serverless
install_serverless() {
    if command -v serverless &>/dev/null; then
        echo "Serverless já está instalado."
    else
        echo "Serverless não está instalado. Instalando..."
        npm install -g serverless
    fi
}

# Identificar o sistema operacional
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Sistema operacional: Linux"
    install_docker
    install_node
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Sistema operacional: macOS"
    install_docker
    install_node
elif [[ "$OSTYPE" == "msys" ]]; then
    echo "Sistema operacional: Windows"
    install_docker
    install_node
else
    echo "Sistema operacional não suportado: $OSTYPE"
    exit 1
fi

# Instalar pacotes npm e pip
install_serverless