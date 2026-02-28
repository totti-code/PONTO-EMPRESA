🏢 PONTO-EMPRESA

Sistema web de controle de ponto empresarial, com autenticação de usuários e armazenamento de registros utilizando Supabase (PostgreSQL na nuvem).

📌 Sobre o Projeto

O PONTO-EMPRESA é uma aplicação web desenvolvida para registrar e gerenciar horários de entrada e saída de funcionários.

O sistema conta com:

Cadastro de usuários

Login com autenticação

Registro de ponto (entrada e saída)

Painel administrativo

Armazenamento em banco de dados na nuvem

Este projeto foi desenvolvido com foco em prática de desenvolvimento web moderno e integração com banco de dados real.

🚀 Tecnologias Utilizadas

HTML5

CSS3

JavaScript

Supabase (PostgreSQL)

GitHub Pages (Deploy)

🗄 Banco de Dados

O sistema utiliza Supabase para:

🔐 Registro de usuários

👤 Autenticação

🕒 Registro de pontos

📊 Armazenamento persistente em nuvem

Estrutura das Tabelas
📌 usuarios

id

nome

email

senha (criptografada)

tipo (admin ou funcionario)

📌 registros_ponto

id

usuario_id

data

hora

tipo (entrada ou saida)

📂 Estrutura do Projeto

PONTO-EMPRESA/

index.html → Tela principal (registro de ponto)

admin.html → Painel administrativo

style.css → Estilização do sistema

script.js → Lógica e integração com Supabase

🖥️ Funcionalidades

✔ Cadastro de usuários
✔ Registro de entrada e saída
✔ Armazenamento em banco de dados na nuvem
✔ Painel administrativo
✔ Interface responsiva

🌐 Acesso Online

O projeto está disponível via GitHub Pages:

https://totti-code.github.io/PONTO-EMPRESA/

🎯 Objetivo

Este projeto foi desenvolvido para:

Praticar integração Front-end + Banco de Dados

Aprender a utilizar APIs

Trabalhar com PostgreSQL na nuvem

Construir portfólio profissional

👨‍💻 Autor

Totti Araújo
Desenvolvedor em formação 🚀
GitHub: https://github.com/totti-code
