from dotenv import load_dotenv, find_dotenv
import pyttsx3

_ = load_dotenv(find_dotenv())

from PyPDF2 import PdfReader

reader = PdfReader("Aspirin.pdf")
raw_text = ""

for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if text:
        raw_text += text


from langchain.text_splitter import CharacterTextSplitter

text_splitter = CharacterTextSplitter(
    separator= "\n",
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len
)

texts = text_splitter.split_text(raw_text)

from langchain.embeddings.openai import OpenAIEmbeddings

emb = OpenAIEmbeddings()

from langchain.vectorstores import FAISS

docsearch = FAISS.from_texts(texts, emb)

from langchain.chat_models import ChatOpenAI
from langchain.chains.question_answering import load_qa_chain

chain = load_qa_chain(ChatOpenAI())

def predict(query, history):
    history_messages = []
    for human, assistant in history:
        history_messages.append({"role": "user", "content": human})
        history_messages.append({"role": "assistant", "content": assistant})

    history_messages.append({"role": "user", "content": query})
    docs = docsearch.similarity_search(query)
    res = chain.run(input_documents=docs, question=query)
    engine = pyttsx3.init()
    yield res
    engine.say(res)
    engine.runAndWait()

import gradio

gradio.ChatInterface(predict,title="Medical_Chatbot").launch()

