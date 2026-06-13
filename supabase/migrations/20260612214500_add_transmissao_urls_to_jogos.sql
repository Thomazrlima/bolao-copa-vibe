with transmissao(time1, time2, url) as (
  values
    ('Estados Unidos', 'Paraguai', 'https://www.youtube.com/watch?v=7EFTDmwcleI'),
    ('Catar', 'Suíça', 'https://www.youtube.com/watch?v=ljah6d9m7Z0'),
    ('Brasil', 'Marrocos', 'https://www.youtube.com/watch?v=vC3fV_awcWE'),
    ('Haiti', 'Escócia', 'https://www.youtube.com/watch?v=yBUg81qhrNo'),
    ('Austrália', 'Turquia', 'https://www.youtube.com/watch?v=8rr-857IbHA'),
    ('Costa do Marfim', 'Equador', 'https://www.youtube.com/watch?v=IFh8Nuuhgcc'),
    ('Suécia', 'Tunísia', 'https://www.youtube.com/watch?v=o2wC007Jp-A'),
    ('Espanha', 'Cabo Verde', 'https://www.youtube.com/watch?v=EYStZQ5FsVk'),
    ('Bélgica', 'Egito', 'https://www.youtube.com/watch?v=aclBHrhLQr4'),
    ('Arábia Saudita', 'Uruguai', 'https://www.youtube.com/watch?v=Mh-iBLsiYDw'),
    ('Irã', 'Nova Zelândia', 'https://www.youtube.com/watch?v=vrY_cXwm--g'),
    ('França', 'Senegal', 'https://www.youtube.com/watch?v=m1vplAfSs_A'),
    ('Argentina', 'Argélia', 'https://www.youtube.com/watch?v=RhpNoBWVQGA'),
    ('Áustria', 'Jordânia', 'https://www.youtube.com/watch?v=r97R-p-TlNM'),
    ('Portugal', 'RD Congo', 'https://www.youtube.com/watch?v=HpzKFDctbNw'),
    ('Inglaterra', 'Croácia', 'https://www.youtube.com/watch?v=DaAFndjKuf8'),
    ('Gana', 'Panamá', 'https://www.youtube.com/watch?v=t7XBWsD5p6A'),
    ('Uzbequistão', 'Colômbia', 'https://www.youtube.com/watch?v=BWsf2c4zKZs'),
    ('Tchéquia', 'África do Sul', 'https://www.youtube.com/watch?v=61qIjGER86Q'),
    ('México', 'Coreia do Sul', 'https://www.youtube.com/watch?v=SVwg-Aiy2po'),
    ('México', 'África do Sul', 'https://www.youtube.com/watch?v=PG2ZEkdEinQ&list=PLsFWLnYCEXEVNzCnkQE-xOuMc8oLxSleC&index=2'),
    ('Coreia do Sul', 'Tchéquia', 'https://www.youtube.com/watch?v=KjQtpF_X5Uw&list=PLsFWLnYCEXEVNzCnkQE-xOuMc8oLxSleC&index=1'),
    ('Canadá', 'Bósnia e Herzegovina', 'https://www.youtube.com/watch?v=on3OBpbOWHg')
)
update public.jogos j
set transmissao_url = t.url
from transmissao t
where j.time1 = t.time1
  and j.time2 = t.time2;
